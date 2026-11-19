'use client';

import React from 'react';

import { usePrintRequest } from './usePrintRequest';
import { PrintFilePanel } from './PrintFilePanel';
import { PrintConfigurationPanel } from './PrintConfigurationPanel';
import { RequestSubmissionForm } from '../print-requests/RequestSubmissionForm';
import { PrintSummaryModal } from './PrintSummaryModal';
import { describePrintSettings } from './print-request-settings';

export const PrintRequestForm: React.FC = () => {
  const model = usePrintRequest();
  const { handleValidate } = model;
  return ((
    <section
      id="in-theo-file"
      className="pt-4 sm:pt-6 pb-14 sm:pb-16 px-4 sm:px-8 bg-transparent text-[#F4F1EA] w-full max-w-full overflow-hidden"
      aria-label="Khu vực gửi tệp in 3D theo yêu cầu"
    >
      <div className="max-w-7xl mx-auto w-full">
        <div className="max-w-3xl mb-8 sm:mb-10 space-y-3 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#141A21] border border-[#27313C] text-[10px] sm:text-[11px] font-mono tracking-wider text-[#A5ADB8] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EB4037]" />
            <span>GỬI FILE IN · MINHLAB 3D</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#F4F1EA] leading-tight">
            In 3D theo file của bạn
          </h1>

          <p className="text-sm sm:text-base text-[#A5ADB8] leading-relaxed">
            Chọn một hoặc nhiều STL để xem nhựa, thời gian in và giá tham khảo FDM. File chỉ tải lên xưởng khi bạn gửi yêu cầu.
          </p>
        </div>

        <form onSubmit={handleValidate} className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-start">
          <PrintFilePanel model={model} />
          <PrintConfigurationPanel model={model} />
        </form>
        {/* Phiếu chỉ gửi linh kiện đang chọn trong khung xem trước. */}
        <RequestSubmissionForm
          preset={{
            file: model.rawFile,
            quantity: Number(model.quantity),
            material: model.material,
            color: model.color,
            purpose: describePrintSettings(model.purpose, model.scalePercent, model.infillPercent, model.layerHeight),
            note: model.notes,
            name: model.fullName,
            phone: model.phone,
            rights: model.confirmedRights,
            validationError: !model.hasValidScale
              ? 'Tỷ lệ in phải nằm trong khoảng 1% đến 5000%.'
              : !model.hasValidQuantity ? 'Số lượng phải là số nguyên từ 1 đến 100.' : null,
          }}
        />
      </div>
      <PrintSummaryModal model={model} />
    </section>
  ));
};

export default PrintRequestForm;
